// @vitest-environment jsdom
import { Editor, mergeAttributes } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { DOMSerializer } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';
import { VideoExtension } from './tiptap-video';

describe('Tiptap security update', () => {
  it('does not inherit executable attributes from a JSON __proto__ key', () => {
    const input = JSON.parse(
      '{"__proto__":{"onerror":"alert(1)","src":"untrusted"},"class":"safe"}',
    );
    const attributes = mergeAttributes(input);

    expect(Object.getPrototypeOf(attributes)).toBe(Object.prototype);
    expect(attributes.class).toBe('safe');
    expect(attributes.onerror).toBeUndefined();
    expect(attributes.src).toBeUndefined();
    // The patched helper may retain __proto__ as an inert own data property.
    // What matters is that DOM serialization cannot pick up executable inherited keys.
    const { dom } = DOMSerializer.renderSpec(document, ['img', attributes]);
    expect((dom as HTMLElement).getAttribute('onerror')).toBeNull();
    expect((dom as HTMLElement).getAttribute('src')).toBeNull();
  });

  it('keeps supported news and information page HTML through editing', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        Image,
        Highlight,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        VideoExtension,
      ],
      content:
        '<h2>Title</h2><p><strong>Bold</strong> <em>Italic</em> <u>Underline</u> <mark>Highlight</mark> <a href="https://example.com">Link</a></p>',
    });

    try {
      const html = editor.getHTML();
      expect(html).toContain('<h2>Title</h2>');
      expect(html).toContain('<strong>Bold</strong>');
      expect(html).toContain('<em>Italic</em>');
      expect(html).toContain('<u>Underline</u>');
      expect(html).toContain('<mark>Highlight</mark>');
      expect(html).toContain('href="https://example.com"');

      editor.commands.setContent(
        '<p>Updated</p><img src="https://example.com/image.png"><video src="https://example.com/video.mp4" controls preload="metadata"></video>',
      );
      const updatedHtml = editor.getHTML();
      expect(updatedHtml).toContain('<p>Updated</p>');
      expect(updatedHtml).toContain('src="https://example.com/image.png"');
      expect(updatedHtml).toContain('<video');
      expect(updatedHtml).toContain('src="https://example.com/video.mp4"');
      expect(updatedHtml).toContain('preload="metadata"');
    } finally {
      editor.destroy();
    }
  });
});
