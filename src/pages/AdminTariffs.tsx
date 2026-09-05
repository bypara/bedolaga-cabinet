import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { tariffsApi, type TariffListItem, type TariffMigrationPreview } from '../api/tariffs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/primitives/Dialog';
import { useDestructiveConfirm, useNotify } from '@/platform';
import { usePlatform } from '../platform/hooks/usePlatform';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import {
  BackIcon,
  CheckIcon,
  EditIcon,
  GiftIcon,
  GripIcon,
  PlusIcon,
  RefreshIcon,
  SaveIcon,
  TrashIcon,
  UsersIcon,
  XIcon,
} from '@/components/icons';

// ============ Sortable Tariff Card ============

interface SortableTariffCardProps {
  tariff: TariffListItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onToggleTrial: () => void;
  onSyncLimits: () => void;
  onMigrate: () => void;
  onViewSubscribers: () => void;
}

function getLimitsActionLabel(tariff: TariffListItem, includeCount = true) {
  const suffix = includeCount ? ` (${tariff.limits_drift_count})` : '';
  if (tariff.traffic_drift_count > 0 && tariff.devices_drift_count === 0) {
    return `Обновить трафик${suffix}`;
  }
  if (tariff.devices_drift_count > 0 && tariff.traffic_drift_count === 0) {
    return `Обновить устройства${suffix}`;
  }
  return `Обновить параметры${suffix}`;
}

function SortableTariffCard({
  tariff,
  onEdit,
  onDelete,
  onToggle,
  onToggleTrial,
  onSyncLimits,
  onMigrate,
  onViewSubscribers,
}: SortableTariffCardProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tariff.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-dark-800 p-4 transition-colors ${
        isDragging
          ? 'border-accent-500/50 shadow-xl shadow-accent-500/20'
          : tariff.is_active
            ? 'border-dark-700'
            : 'border-dark-700/50 opacity-60'
      }`}
    >
      <div className="flex gap-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 flex-shrink-0 cursor-grab touch-none rounded-lg p-2.5 text-dark-500 hover:bg-dark-700/50 hover:text-dark-300 active:cursor-grabbing sm:p-1.5"
          title={t('admin.tariffs.dragToReorder')}
        >
          <GripIcon />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="truncate font-medium text-dark-100">{tariff.name}</h3>
                {tariff.is_daily ? (
                  <span className="rounded bg-warning-500/20 px-2 py-0.5 text-xs text-warning-400">
                    {t('admin.tariffs.dailyType')}
                  </span>
                ) : (
                  <span className="rounded bg-accent-500/20 px-2 py-0.5 text-xs text-accent-400">
                    {t('admin.tariffs.periodType')}
                  </span>
                )}
                {tariff.is_trial_available && (
                  <span className="rounded bg-success-500/20 px-2 py-0.5 text-xs text-success-400">
                    {t('admin.tariffs.trial')}
                  </span>
                )}
                {tariff.show_in_gift && (
                  <span className="inline-flex items-center gap-1 rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                    <GiftIcon className="h-3 w-3" />
                    {t('admin.tariffs.giftBadge')}
                  </span>
                )}
                {!tariff.is_active && (
                  <span className="rounded bg-dark-600 px-2 py-0.5 text-xs text-dark-400">
                    {t('admin.tariffs.inactive')}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-dark-400">
                {tariff.is_daily && tariff.daily_price_kopeks > 0 && (
                  <span className="text-warning-400">
                    {(tariff.daily_price_kopeks / 100).toFixed(2)}{' '}
                    {t('admin.tariffs.currencyPerDay')}
                  </span>
                )}
                <span>
                  {tariff.traffic_limit_gb === 0
                    ? t('admin.tariffs.unlimited')
                    : `${tariff.traffic_limit_gb} GB`}
                </span>
                <span>{t('admin.tariffs.devices', { count: tariff.device_limit })}</span>
                <span>{t('admin.tariffs.servers', { count: tariff.servers_count })}</span>
                <button
                  type="button"
                  onClick={onViewSubscribers}
                  className="rounded text-left text-accent-400 underline decoration-accent-500/40 underline-offset-2 transition-colors hover:text-accent-300"
                  title={t('admin.tariffs.viewSubscribers', 'Показать подписчиков')}
                >
                  {t('admin.tariffs.subscriptions', { count: tariff.subscriptions_count })}
                </button>
              </div>
              {(tariff.limits_drift_count > 0 || tariff.subscriptions_count > 0) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tariff.limits_drift_count > 0 && (
                    <button
                      onClick={onSyncLimits}
                      className="inline-flex items-center gap-2 rounded-lg border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-xs font-medium text-warning-300 transition-colors hover:bg-warning-500/20"
                    >
                      <RefreshIcon className="h-4 w-4" />
                      {getLimitsActionLabel(tariff)}
                    </button>
                  )}
                  {tariff.subscriptions_count > 0 && (
                    <button
                      onClick={onMigrate}
                      className="inline-flex items-center gap-2 rounded-lg border border-accent-500/30 bg-accent-500/10 px-3 py-2 text-xs font-medium text-accent-300 transition-colors hover:bg-accent-500/20"
                    >
                      <UsersIcon className="h-4 w-4" />
                      Перенести подписчиков
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 sm:flex-shrink-0">
              <button
                onClick={onToggle}
                className={`rounded-lg p-2 transition-colors ${
                  tariff.is_active
                    ? 'bg-success-500/20 text-success-400 hover:bg-success-500/30'
                    : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
                }`}
                title={
                  tariff.is_active ? t('admin.tariffs.deactivate') : t('admin.tariffs.activate')
                }
              >
                {tariff.is_active ? <CheckIcon /> : <XIcon />}
              </button>

              <button
                onClick={onToggleTrial}
                className={`rounded-lg p-2 transition-colors ${
                  tariff.is_trial_available
                    ? 'bg-accent-500/20 text-accent-400 hover:bg-accent-500/30'
                    : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
                }`}
                title={t('admin.tariffs.toggleTrial')}
              >
                <GiftIcon />
              </button>

              <button
                onClick={onEdit}
                className="rounded-lg bg-dark-700 p-2 text-dark-300 transition-colors hover:bg-dark-600 hover:text-dark-100"
                title={t('admin.tariffs.edit')}
              >
                <EditIcon />
              </button>

              <button
                onClick={onDelete}
                className="rounded-lg bg-dark-700 p-2 text-dark-300 transition-colors hover:bg-error-500/20 hover:text-error-400"
                title={t('admin.tariffs.delete')}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Main Page ============

export default function AdminTariffs() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirmDelete = useDestructiveConfirm();
  const notify = useNotify();
  const { capabilities } = usePlatform();

  const [localTariffs, setLocalTariffs] = useState<TariffListItem[]>([]);
  const [orderChanged, setOrderChanged] = useState(false);
  const [syncTariff, setSyncTariff] = useState<TariffListItem | null>(null);
  const [migrationTariff, setMigrationTariff] = useState<TariffListItem | null>(null);
  const [targetTariffId, setTargetTariffId] = useState('');
  const [migrationPreview, setMigrationPreview] = useState<TariffMigrationPreview | null>(null);

  // Queries
  const { data: tariffsData, isLoading } = useQuery({
    queryKey: ['admin-tariffs'],
    queryFn: () => tariffsApi.getTariffs(true),
  });

  // Sync fetched data to local state
  useEffect(() => {
    if (tariffsData?.tariffs && !orderChanged) {
      setLocalTariffs(tariffsData.tariffs);
    }
  }, [tariffsData, orderChanged]);

  // Save order mutation
  const saveOrderMutation = useMutation({
    mutationFn: (tariffIds: number[]) => tariffsApi.updateOrder(tariffIds),
    onSuccess: () => {
      setOrderChanged(false);
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
      notify.success(t('admin.tariffs.orderSaved'));
    },
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: tariffsApi.deleteTariff,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
      if (data.affected_subscriptions > 0) {
        notify.success(
          t('admin.tariffs.deleteSuccessWithSubscriptions', { count: data.affected_subscriptions }),
        );
      } else {
        notify.success(t('admin.tariffs.deleteSuccess'));
      }
    },
  });

  const handleDelete = async (tariff: TariffListItem) => {
    const confirmText =
      tariff.subscriptions_count > 0
        ? t('admin.tariffs.confirmDeleteWithSubscriptions', {
            count: tariff.subscriptions_count,
          })
        : t('admin.tariffs.confirmDeleteText');

    const confirmed = await confirmDelete(
      confirmText,
      t('common.delete'),
      t('admin.tariffs.confirmDelete'),
    );

    if (confirmed) {
      deleteMutation.mutate(tariff.id);
    }
  };

  const toggleMutation = useMutation({
    mutationFn: tariffsApi.toggleTariff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
    },
  });

  const toggleTrialMutation = useMutation({
    mutationFn: tariffsApi.toggleTrial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
    },
  });

  const syncLimitsMutation = useMutation({
    mutationFn: ({ tariffId, dryRun }: { tariffId: number; dryRun: boolean }) =>
      tariffsApi.syncLimits(tariffId, dryRun),
    onSuccess: (data, variables) => {
      if (!variables.dryRun) {
        queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
        notify.success(`Параметры обновлены у ${data.updated_count ?? 0} подписок`);
        setSyncTariff(null);
      }
    },
  });

  const migrationMutation = useMutation({
    mutationFn: ({
      sourceId,
      targetId,
      dryRun,
    }: {
      sourceId: number;
      targetId: number;
      dryRun: boolean;
    }) => tariffsApi.migrateSubscriptions(sourceId, targetId, dryRun),
    onSuccess: (data, variables) => {
      if (variables.dryRun) {
        setMigrationPreview(data);
      } else {
        queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
        notify.success(`Перенесено подписок: ${data.moved_count}`);
        setMigrationTariff(null);
        setTargetTariffId('');
        setMigrationPreview(null);
      }
    },
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalTariffs((prev) => {
        const oldIndex = prev.findIndex((t) => t.id === active.id);
        const newIndex = prev.findIndex((t) => t.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
      setOrderChanged(true);
    }
  }, []);

  const handleSaveOrder = () => {
    saveOrderMutation.mutate(localTariffs.map((t) => t.id));
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {/* Show back button only on web, not in Telegram Mini App */}
          {!capabilities.hasBackButton && (
            <button
              onClick={() => navigate('/admin')}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-dark-700 bg-dark-800 transition-colors hover:border-dark-600"
            >
              <BackIcon />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-dark-100">{t('admin.tariffs.title')}</h1>
            <p className="text-sm text-dark-400">{t('admin.tariffs.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {orderChanged && (
            <button
              onClick={handleSaveOrder}
              disabled={saveOrderMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-success-500 px-4 py-2 text-white transition-colors hover:bg-success-600"
            >
              {saveOrderMutation.isPending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <SaveIcon className="h-4 w-4" />
              )}
              {t('admin.tariffs.saveOrder')}
            </button>
          )}
          <button
            onClick={() => navigate('/admin/tariffs/create')}
            className="flex items-center justify-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-on-accent transition-colors hover:bg-accent-600"
          >
            <PlusIcon />
            {t('admin.tariffs.create')}
          </button>
        </div>
      </div>

      {/* Drag hint */}
      <div className="mb-4 flex items-center gap-2 text-sm text-dark-500">
        <GripIcon />
        {t('admin.tariffs.dragToReorder')}
      </div>

      {/* Tariffs List */}
      {isLoading ? (
        <SkeletonGroup className="space-y-3">
          <Skeleton variant="card" count={3} className="h-16" />
        </SkeletonGroup>
      ) : localTariffs.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-dark-400">{t('admin.tariffs.noTariffs')}</p>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={localTariffs.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {localTariffs.map((tariff) => (
                <SortableTariffCard
                  key={tariff.id}
                  tariff={tariff}
                  onEdit={() => navigate(`/admin/tariffs/${tariff.id}/edit`)}
                  onDelete={() => handleDelete(tariff)}
                  onToggle={() => toggleMutation.mutate(tariff.id)}
                  onToggleTrial={() => toggleTrialMutation.mutate(tariff.id)}
                  onSyncLimits={() => {
                    setSyncTariff(tariff);
                    syncLimitsMutation.mutate({ tariffId: tariff.id, dryRun: true });
                  }}
                  onMigrate={() => {
                    setMigrationTariff(tariff);
                    setTargetTariffId('');
                    setMigrationPreview(null);
                  }}
                  onViewSubscribers={() => navigate(`/admin/users?tariff_id=${tariff.id}`)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={syncTariff !== null} onOpenChange={(open) => !open && setSyncTariff(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {syncTariff ? getLimitsActionLabel(syncTariff, false) : 'Обновить параметры'} подписок
            </DialogTitle>
            <DialogDescription>
              Тариф «{syncTariff?.name}». Срок, статус, использованный трафик и оплаченные
              дополнения сохранятся.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-dark-800 p-3">
              <div className="text-dark-400">Трафик</div>
              <div className="mt-1 text-lg font-semibold text-dark-100">
                {syncTariff?.traffic_drift_count ?? 0}
              </div>
            </div>
            <div className="rounded-xl bg-dark-800 p-3">
              <div className="text-dark-400">Устройства</div>
              <div className="mt-1 text-lg font-semibold text-dark-100">
                {syncTariff?.devices_drift_count ?? 0}
              </div>
            </div>
          </div>
          <p className="text-xs text-dark-400">
            Текущая статистика будет повторно проверена сервером непосредственно перед применением.
          </p>
          <DialogFooter>
            <button
              onClick={() => setSyncTariff(null)}
              className="rounded-lg px-4 py-2 text-dark-300 hover:bg-dark-800"
            >
              Отмена
            </button>
            <button
              disabled={!syncTariff || syncLimitsMutation.isPending}
              onClick={() =>
                syncTariff && syncLimitsMutation.mutate({ tariffId: syncTariff.id, dryRun: false })
              }
              className="rounded-lg bg-accent-500 px-4 py-2 font-medium text-on-accent disabled:opacity-50"
            >
              {syncLimitsMutation.isPending ? 'Обновляем…' : 'Обновить параметры'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={migrationTariff !== null}
        onOpenChange={(open) => !open && setMigrationTariff(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Перенести подписчиков</DialogTitle>
            <DialogDescription>
              Срок и статус подписок сохранятся. Рекуррентные платежи старого тарифа будут
              отключены.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm text-dark-300">
            <span>Новый тариф</span>
            <select
              value={targetTariffId}
              onChange={(event) => {
                setTargetTariffId(event.target.value);
                setMigrationPreview(null);
              }}
              className="w-full rounded-xl border border-dark-700 bg-dark-800 px-3 py-2.5 text-dark-100 outline-none focus:border-accent-500"
            >
              <option value="">Выберите тариф</option>
              {localTariffs
                .filter(
                  (item) =>
                    item.id !== migrationTariff?.id && item.is_daily === migrationTariff?.is_daily,
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          {migrationPreview && (
            <div className="space-y-2 rounded-xl border border-dark-700 bg-dark-800/60 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-400">Будет перенесено</span>
                <strong>{migrationPreview.movable_count}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Уже есть целевой тариф</span>
                <strong>{migrationPreview.conflict_count}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Отключится рекуррентов</span>
                <strong>{migrationPreview.recurring_cancellations}</strong>
              </div>
              {migrationPreview.legacy_device_baselines > 0 && (
                <p className="pt-2 text-xs text-warning-300">
                  У {migrationPreview.legacy_device_baselines} подписок старые данные устройств
                  неоднозначны — их текущие дополнительные слоты будут сохранены.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <button
              onClick={() => setMigrationTariff(null)}
              className="rounded-lg px-4 py-2 text-dark-300 hover:bg-dark-800"
            >
              Отмена
            </button>
            {!migrationPreview ? (
              <button
                disabled={!migrationTariff || !targetTariffId || migrationMutation.isPending}
                onClick={() =>
                  migrationTariff &&
                  migrationMutation.mutate({
                    sourceId: migrationTariff.id,
                    targetId: Number(targetTariffId),
                    dryRun: true,
                  })
                }
                className="rounded-lg bg-dark-700 px-4 py-2 font-medium text-dark-100 disabled:opacity-50"
              >
                {migrationMutation.isPending ? 'Проверяем…' : 'Проверить перенос'}
              </button>
            ) : (
              <button
                disabled={migrationPreview.movable_count === 0 || migrationMutation.isPending}
                onClick={() =>
                  migrationTariff &&
                  migrationMutation.mutate({
                    sourceId: migrationTariff.id,
                    targetId: Number(targetTariffId),
                    dryRun: false,
                  })
                }
                className="rounded-lg bg-accent-500 px-4 py-2 font-medium text-on-accent disabled:opacity-50"
              >
                {migrationMutation.isPending
                  ? 'Переносим…'
                  : `Перенести ${migrationPreview.movable_count}`}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
