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
import { Menu, Modal } from "@mantine/core";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useTranslation } from "@/lib/i18n";
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
  const t = useTranslation();
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
    } catch { showError(t("Không tải được ảnh đề bài.")); } finally { setBusy(false); }
  }

  function saveLink() {
    if (!/^(https?:\/\/|mailto:)/i.test(href)) { setError("Liên kết phải bắt đầu bằng https://, http:// hoặc mailto:."); return; }
    editor?.chain().focus().setLink({ href }).run(); setError(""); setLinkOpen(false);
  }

  const dialogClasses = { content: "quiz-editor-dialog", header: "quiz-editor-dialog-header", close: "quiz-editor-dialog-close" };
  return <>
    <RichTextEditor editor={editor} className="quiz-editor quiz-richtext">
      <RichTextEditor.Toolbar aria-label={t("Định dạng đề bài")} className="quiz-editor-toolbar">
        <RichTextEditor.ControlsGroup><RichTextEditor.Bold /><RichTextEditor.Italic /><RichTextEditor.Underline /><RichTextEditor.Strikethrough /></RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup><RichTextEditor.H1 /><RichTextEditor.H2 /><RichTextEditor.H3 /><RichTextEditor.Blockquote /></RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup><RichTextEditor.BulletList /><RichTextEditor.OrderedList /></RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup><RichTextEditor.AlignLeft /><RichTextEditor.AlignCenter /><RichTextEditor.AlignRight /><RichTextEditor.AlignJustify /></RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup><RichTextEditor.ColorPicker colors={["#20223d", "#5145c7", "#2563c8", "#c7355c", "#147d64", "#b45309"]} /><RichTextEditor.UnsetColor /></RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Control aria-label={t("Chèn hoặc sửa liên kết")} title={t("Liên kết")} active={!!editor?.isActive("link")} onClick={() => { setError(""); setHref(editor?.getAttributes("link").href || ""); setLinkOpen(true); }}><Link2 size={16} /></RichTextEditor.Control>
          <RichTextEditor.Unlink />
          <Menu withinPortal position="bottom-start"><Menu.Target><RichTextEditor.Control aria-label={t("Tùy chọn bảng")} title={t("Bảng")}><Table2 size={16} /></RichTextEditor.Control></Menu.Target><Menu.Dropdown className="quiz-editor-menu"><Menu.Item onClick={() => editor?.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()}>{t("Chèn bảng 2 × 2")}</Menu.Item><Menu.Item disabled={!editor?.isActive("table")} onClick={() => editor?.chain().focus().addRowAfter().run()}>{t("Thêm dòng")}</Menu.Item><Menu.Item disabled={!editor?.isActive("table")} onClick={() => editor?.chain().focus().addColumnAfter().run()}>{t("Thêm cột")}</Menu.Item><Menu.Item disabled={!editor?.isActive("table")} onClick={() => editor?.chain().focus().deleteTable().run()}>{t("Xóa bảng")}</Menu.Item></Menu.Dropdown></Menu>
          <RichTextEditor.Control aria-label={t("Chèn ảnh")} title={t("Chèn ảnh")} disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus size={16} /></RichTextEditor.Control>
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup><RichTextEditor.Undo /><RichTextEditor.Redo /></RichTextEditor.ControlsGroup>
      </RichTextEditor.Toolbar>
      <RichTextEditor.Content />
    </RichTextEditor>
    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) chooseFile(file); event.target.value = ""; }} />
    {error && !linkOpen && <p role="alert" className="mt-2 rounded-xl ds-error p-3 text-sm">{t(error)}</p>}
    <Modal opened={!!pendingFile} onClose={() => { if (!busy) setPendingFile(null); }} title={t("Mô tả ảnh")} centered classNames={dialogClasses} closeButtonProps={{ "aria-label": t("Đóng"), disabled: busy }}>
      <form onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void upload(); }}>
        <Field label={t("Mô tả cho người dùng trình đọc màn hình")}>
          <Input className="mt-2" value={alt} onChange={(event) => setAlt(event.currentTarget.value)} required disabled={busy} data-autofocus />
        </Field>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setPendingFile(null)} disabled={busy}>{t("Hủy")}</Button>
          <Button type="submit" disabled={busy}>{t(busy ? "Đang tải ảnh…" : "Chèn ảnh")}</Button>
        </div>
      </form>
    </Modal>
    <Modal opened={linkOpen} onClose={() => { setError(""); setLinkOpen(false); }} title={t("Liên kết")} centered classNames={dialogClasses} closeButtonProps={{ "aria-label": t("Đóng") }}>
      <form onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); saveLink(); }}>
        <Field label="URL" error={error ? t(error) : undefined}>
          <Input className="mt-2" placeholder="https://example.com/" value={href} onChange={(event) => { setHref(event.currentTarget.value); setError(""); }} aria-invalid={!!error} required data-autofocus />
        </Field>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => { setError(""); setLinkOpen(false); }}>{t("Hủy")}</Button>
          <Button type="submit">{t("Lưu")}</Button>
        </div>
      </form>
    </Modal>
  </>;
}
