import { api } from './local';
type FileContent = { data: string; mimeType: string };

export async function generateQuizFromBook(bookTitle: string, content: FileContent) {
  return (await api('/ai/quiz', { bookTitle, content })).result;
}
export async function extractStudentsFromIDCards(content: FileContent) {
  return (await api('/ai/students', { content })).result;
}
export async function extractEventsFromCalendar(content: FileContent) {
  return (await api('/ai/calendar', { content })).result;
}
