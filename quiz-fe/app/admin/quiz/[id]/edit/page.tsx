import { quizMetadata } from "@/lib/quiz-metadata";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return quizMetadata("/teacher/quizzes/" + encodeURIComponent((await params).id), true);
}

import TeacherPage from "@/components/teacher-quiz-page";

export default function EditQuizPage() { return <TeacherPage mode="edit" admin />; }
