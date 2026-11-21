/** Settle on error or abort as well as success, so forms can leave the busy state. */
export function readFileUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The file could not be read.'));
    reader.onerror = () => reject(new Error('The file could not be read. Select it again and retry.'));
    reader.onabort = () => reject(new Error('File reading was cancelled.'));
    reader.readAsDataURL(file);
  });
}

export function newStudentRows<T extends { studentId: string }>(rows: T[], existing: string[]) {
  const seen = new Set(existing.map(id => id.trim().toLowerCase()));
  return rows.flatMap(row => {
    const studentId = row.studentId.trim();
    const key = studentId.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...row, studentId }];
  });
}
