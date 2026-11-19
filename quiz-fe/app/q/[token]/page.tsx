import type { Metadata } from "next";
import { quizMetadata } from "@/lib/quiz-metadata";
import StudentQuizPage from "./student-quiz";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  return quizMetadata("/public/quizzes/" + encodeURIComponent((await params).token));
}

export default StudentQuizPage;
