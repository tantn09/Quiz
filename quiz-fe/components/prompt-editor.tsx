"use client";

import { useErrorToast } from "@/components/ui/toast";
import { useEffect, useRef, useState } from "react";
import { useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import FileHandler from "@tiptap/extension-file-handler";
import { Button, Group, Menu, Modal, TextInput } from "@mantine/core";
import { RichTextEditor } from "@mantine/tiptap";
import { ImagePlus, Link2, Table2 } from "lucide-react";

export type PromptDocument = JSONContent;
export const emptyPrompt: PromptDocument = { type: "doc", content: [] };
export function promptImages(document: PromptDocument): string[] {
  const ids: string[] = [];
  const walk = (node: JSONContent) => { if (node.type === "image" && typeof node.attrs?.src === "string") ids.push(node.attrs.src.split("/").pop()!); node.content?.forEach(walk); };
  walk(document);
  return [...new Set(ids)];
}

const extensions = [StarterKit, Image, Link.configure({ openOnClick: false }), TextAlign.configure({ types: ["heading", "paragraph"] }), TableKit, TextStyle, Color, Underline];

export function PromptEditor({ value, onChange }: { value: PromptDocument; onChange: (value: PromptDocument) => void }) {
  const showError = useErrorToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [...extensions, FileHandler.configure({
      onPaste: (_editor, files) => { if (files[0]) chooseFile(files[0]); },
      onDrop: (_editor, files) => { if (files[0]) chooseFile(files[0]); },
    })],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });
  useEffect(() => { if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) editor.commands.setContent(value); }, [editor, value]);

  function chooseFile(file: File) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5_000_000) { setError("Ảnh phải là PNG, JPEG hoặc WebP và không quá 5 MB."); return; }
    setError(""); setAlt(file.name.replace(/\.[^.]+$/, "")); setPendingFile(file);
  }

  async function upload() {
    if (!pendingFile || !alt.trim()) return;
    setBusy(true); setError("");
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(pendingFile); });
      const response = await fetch("/api/teacher/assets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data }) });
      if (!response.ok) throw new Error();
      const { id } = await response.json();
      editor?.chain().focus().setImage({ src: `/api/public/assets/${id}`, alt: alt.trim() }).run();
      setPendingFile(null);
    } catch { showError("Không tải được ảnh. Vui lòng thử lại."); } finally { setBusy(false); }
  }

  function saveLink() {
    if (!/^(https?:\/\/|mailto:)/i.test(href)) { setError("Liên kết phải bắt đầu bằng https://, http:// hoặc mailto:."); return; }
    editor?.chain().focus().setLink({ href }).run(); setError(""); setLinkOpen(false);
  }

  return <>
    <RichTextEditor editor={editor} className="quiz-editor quiz-richtext">
      <RichTextEditor.Toolbar aria-label="Định dạng đề bài" className="quiz-editor-toolbar">
        <RichTextEditor.ControlsGroup><RichTextEditor.Bold /><RichTextEditor.Italic /><RichTextEditor.Underline /><RichTextEditor.Strikethrough /></RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup><RichTextEditor.H1 /><RichTextEditor.H2 /><RichTextEditor.H3 /><RichTextEditor.Blockquote /></RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup><RichTextEditor.BulletList /><RichTextEditor.OrderedList /></RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup><RichTextEditor.AlignLeft /><RichTextEditor.AlignCenter /><RichTextEditor.AlignRight /><RichTextEditor.AlignJustify /></RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup><RichTextEditor.ColorPicker colors={["#20223d", "#5145c7", "#2563c8", "#c7355c", "#147d64", "#b45309"]} /><RichTextEditor.UnsetColor /></RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Control aria-label="Chèn hoặc sửa liên kết" title="Liên kết" active={!!editor?.isActive("link")} onClick={() => { setHref(editor?.getAttributes("link").href || ""); setLinkOpen(true); }}><Link2 size={16} /></RichTextEditor.Control>
          <RichTextEditor.Unlink />
          <Menu withinPortal position="bottom-start"><Menu.Target><RichTextEditor.Control aria-label="Tùy chọn bảng" title="Bảng"><Table2 size={16} /></RichTextEditor.Control></Menu.Target><Menu.Dropdown><Menu.Item onClick={() => editor?.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()}>Chèn bảng 2 × 2</Menu.Item><Menu.Item disabled={!editor?.isActive("table")} onClick={() => editor?.chain().focus().addRowAfter().run()}>Thêm dòng</Menu.Item><Menu.Item disabled={!editor?.isActive("table")} onClick={() => editor?.chain().focus().addColumnAfter().run()}>Thêm cột</Menu.Item><Menu.Item disabled={!editor?.isActive("table")} onClick={() => editor?.chain().focus().deleteTable().run()}>Xóa bảng</Menu.Item></Menu.Dropdown></Menu>
          <RichTextEditor.Control aria-label="Chèn ảnh" title="Chèn ảnh" disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus size={16} /></RichTextEditor.Control>
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup><RichTextEditor.Undo /><RichTextEditor.Redo /></RichTextEditor.ControlsGroup>
      </RichTextEditor.Toolbar>
      <RichTextEditor.Content />
    </RichTextEditor>
    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) chooseFile(file); event.target.value = ""; }} />
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    <Modal opened={!!pendingFile} onClose={() => { if (!busy) setPendingFile(null); }} title="Mô tả ảnh" centered><form onSubmit={(event) => { event.preventDefault(); void upload(); }}><TextInput label="Mô tả cho người dùng trình đọc màn hình" value={alt} onChange={(event) => setAlt(event.currentTarget.value)} required autoFocus /><Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setPendingFile(null)} disabled={busy}>Hủy</Button><Button type="submit" loading={busy}>Chèn ảnh</Button></Group></form></Modal>
    <Modal opened={linkOpen} onClose={() => setLinkOpen(false)} title="Liên kết" centered><form onSubmit={(event) => { event.preventDefault(); saveLink(); }}><TextInput label="URL" placeholder="https://example.com/" value={href} onChange={(event) => setHref(event.currentTarget.value)} required autoFocus /><Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setLinkOpen(false)}>Hủy</Button><Button type="submit">Lưu</Button></Group></form></Modal>
  </>;
}
