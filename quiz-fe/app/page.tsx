"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Check, CheckCircle2, FileQuestion, Link2, MousePointer2, Sparkles, Star, WandSparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function HomePage() {
  const t = useTranslation();
  const steps = [
    { number: "01", icon: WandSparkles, title: t("Tạo bài kiểm tra linh hoạt"), body: t("Soạn câu hỏi trắc nghiệm, tự luận hoặc nhập nhanh từ Excel."), tone: "peach" },
    { number: "02", icon: Link2, title: t("Chia sẻ bằng một link"), body: t("Gửi bài cho học sinh thật nhanh, không cần nhiều bước phức tạp."), tone: "lilac" },
    { number: "03", icon: BarChart3, title: t("Nắm bắt kết quả"), body: t("Xem bài làm, chấm điểm và xuất kết quả khi bạn cần."), tone: "mint" },
  ];

  return (
    <main className="landing-v2 min-h-screen overflow-hidden text-content">
      <header className="landing-v2-header mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-extrabold tracking-tight" aria-label={t("Bài kiểm tra lớp học - Trang chủ")}>
          <span className="landing-v2-logo flex size-10 items-center justify-center rounded-[14px] text-white"><FileQuestion size={21} strokeWidth={2.2} aria-hidden="true" /></span>
          <span className="text-lg">quiz<span className="text-brand">.</span>lớp học</span>
        </Link>
        <nav className="flex items-center gap-6" aria-label={t("Điều hướng chính")}>
          <a href="#tinh-nang" className="hidden text-sm font-semibold text-content-muted hover:text-content sm:inline">{t("Tính năng")}</a>
          <Link href="/login" className="landing-v2-login inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5">{t("Đăng nhập")}<ArrowRight size={16} aria-hidden="true" /></Link>
        </nav>
      </header>

      <section className="landing-v2-hero relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-28 pt-14 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:gap-8 lg:pb-36 lg:pt-24">
        <div className="relative z-10 max-w-xl">
          <span className="landing-v2-eyebrow inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold"><Sparkles size={16} aria-hidden="true" />{t("Một lớp học, nhiều khoảnh khắc tiến bộ")}</span>
          <h1 className="mt-7 text-[clamp(3.3rem,6.1vw,5.7rem)] font-black leading-[1.04] tracking-[-.06em]">{t("Dạy học thú vị.")}<br /><span className="landing-v2-gradient-text">{t("Đánh giá dễ dàng.")}</span></h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-content-muted">{t("Tạo bài kiểm tra trong vài phút, gửi một đường link cho học sinh và theo dõi kết quả ngay trên cùng một nơi.")}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="landing-v2-primary inline-flex min-h-13 items-center justify-center gap-3 rounded-2xl px-7 py-3 font-bold text-white transition-transform hover:-translate-y-0.5">{t("Bắt đầu tạo bài kiểm tra")}<ArrowRight size={18} aria-hidden="true" /></Link>
            <a href="#tinh-nang" className="landing-v2-secondary inline-flex min-h-13 items-center justify-center rounded-2xl px-7 py-3 font-bold transition-transform hover:-translate-y-0.5">{t("Khám phá tính năng")}</a>
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm text-content-muted"><CheckCircle2 size={17} className="text-brand" aria-hidden="true" />{t("Dành cho giáo viên, học sinh và người quản lý")}</p>
        </div>

        <div className="landing-v2-art relative mx-auto w-full max-w-[620px]" role="img" aria-label={t("Minh họa giao diện bài kiểm tra")}>
          <div className="landing-v2-blob" aria-hidden="true" />
          <div className="landing-v2-spark landing-v2-spark-one" aria-hidden="true"><Star size={31} fill="currentColor" /></div>
          <div className="landing-v2-spark landing-v2-spark-two" aria-hidden="true"><Star size={18} fill="currentColor" /></div>
          <div className="landing-v2-quiz relative mx-auto max-w-[500px] rotate-[-2deg] rounded-[30px] p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-5"><div className="flex items-center gap-3"><span className="landing-v2-quiz-icon flex size-11 items-center justify-center rounded-2xl"><FileQuestion size={22} /></span><div><p className="font-bold">{t("Kiểm tra kiến thức")}</p><p className="text-xs text-content-muted">{t("Lớp học của bạn")}</p></div></div><span className="landing-v2-live rounded-full px-3 py-1.5 text-xs font-bold">● {t("Đang mở")}</span></div>
            <p className="mt-6 text-xs font-extrabold uppercase tracking-[.16em] text-brand">{t("Câu hỏi 01 / 05")}</p>
            <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{t("Điều gì tạo nên một lớp học tốt?")}</h2>
            <div className="mt-6 space-y-3">{[t("Sự tò mò và chủ động"), t("Những câu hỏi hay"), t("Cùng nhau tiến bộ")].map((answer, index) => <div key={answer} className={`landing-v2-answer flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold ${index === 0 ? "landing-v2-answer-selected" : ""}`}><span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-current text-xs">{index === 0 ? <Check size={16} /> : String.fromCharCode(65 + index)}</span>{answer}</div>)}</div>
            <div className="mt-7 flex items-center justify-between gap-3"><div className="flex gap-1.5"><span className="h-2 w-7 rounded-full bg-brand" /><span className="size-2 rounded-full bg-line" /><span className="size-2 rounded-full bg-line" /><span className="size-2 rounded-full bg-line" /></div><span className="landing-v2-next rounded-xl px-5 py-2.5 text-sm font-bold text-white">{t("Tiếp tục")} →</span></div>
          </div>
          <div className="landing-v2-float absolute -bottom-7 -left-1 flex items-center gap-3 rounded-2xl px-4 py-3 sm:-left-8"><span className="landing-v2-float-icon flex size-10 items-center justify-center rounded-xl"><BarChart3 size={20} /></span><div><p className="text-sm font-bold">{t("Kết quả rõ ràng")}</p><p className="text-xs text-content-muted">{t("Theo dõi từng bài làm")}</p></div></div>
          <div className="landing-v2-pointer absolute -right-2 top-10 hidden rotate-12 rounded-2xl px-3 py-2 text-white sm:block"><MousePointer2 size={21} fill="currentColor" /></div>
        </div>
      </section>

      <section id="tinh-nang" className="landing-v2-features py-20 sm:py-28"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="mx-auto max-w-2xl text-center"><p className="text-sm font-extrabold uppercase tracking-[.18em] text-brand">{t("Đơn giản từ đầu đến cuối")}</p><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{t("Mọi thứ bạn cần cho một buổi học hiệu quả.")}</h2><p className="mt-4 text-content-muted">{t("Tập trung vào việc dạy và học. Những phần còn lại đã có Bài kiểm tra lớp học hỗ trợ.")}</p></div><div className="mt-12 grid gap-5 md:grid-cols-3">{steps.map(({ number, icon: Icon, title, body, tone }) => <article key={number} className={`landing-v2-step landing-v2-step-${tone} rounded-[28px] p-7 sm:p-8`}><div className="flex items-start justify-between"><span className="landing-v2-step-icon flex size-14 items-center justify-center rounded-[20px]"><Icon size={26} strokeWidth={1.9} aria-hidden="true" /></span><span className="text-2xl font-black opacity-25">{number}</span></div><h3 className="mt-10 text-xl font-bold">{title}</h3><p className="mt-3 leading-7 text-content-muted">{body}</p></article>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28"><div className="landing-v2-cta relative overflow-hidden rounded-[36px] px-7 py-14 text-center text-white sm:px-14 sm:py-20"><div className="relative z-10 mx-auto max-w-2xl"><p className="text-sm font-bold uppercase tracking-[.18em] text-white/80">{t("Sẵn sàng cho lớp học tiếp theo?")}</p><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">{t("Một bài kiểm tra hay bắt đầu từ một ý tưởng nhỏ.")}</h2><p className="mt-5 leading-7 text-white/85">{t("Đăng nhập và biến ý tưởng đó thành hoạt động học tập đáng nhớ.")}</p><Link href="/login" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-7 font-bold text-blue-700 transition-transform hover:-translate-y-0.5">{t("Đăng nhập để bắt đầu")}<ArrowRight size={18} aria-hidden="true" /></Link></div><div className="landing-v2-cta-deco" aria-hidden="true" /></div></section>
      <footer className="border-t border-line py-7"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-2 px-5 text-sm text-content-muted sm:flex-row sm:px-8"><span className="font-bold text-content">quiz<span className="text-brand">.</span>lớp học</span><span>{t("Học tập chủ động, mỗi ngày một chút.")}</span></div></footer>
    </main>
  );
}
