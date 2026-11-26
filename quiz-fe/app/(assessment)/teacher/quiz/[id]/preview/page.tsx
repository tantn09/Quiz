import { QuizPreview } from "@/features/quizzes/quiz-preview";

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ variant?: string | string[] }>;
}) {
  const [{ id }, { variant }] = await Promise.all([params, searchParams]);
  return <QuizPreview key={id} id={id} back={`/teacher/quiz/${encodeURIComponent(id)}`}
    initialVariant={typeof variant === "string" ? variant : undefined} />;
}
