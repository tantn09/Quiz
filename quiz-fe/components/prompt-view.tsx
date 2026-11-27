"use client";
import { useMemo } from "react";
import { generateHTML, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import { TextStyle } from "@tiptap/extension-text-style";
import { PromptColor } from "@/lib/prompt-color";
import Underline from "@tiptap/extension-underline";

export function PromptView({ document }: { document: JSONContent }) {
  const html = useMemo(() => generateHTML(document, [StarterKit, Image, Link, TextAlign.configure({ types: ["heading", "paragraph"] }), TableKit, TextStyle, PromptColor, Underline]), [document]);
  return <div className="quiz-richtext mt-3" dangerouslySetInnerHTML={{ __html: html }} />;
}
