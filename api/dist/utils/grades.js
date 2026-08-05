export function calculateGrade(assessment, exam) {
    if (assessment < 0 || assessment > 40) {
        throw new Error("Assessment must be between 0 and 40");
    }
    if (exam < 0 || exam > 60) {
        throw new Error("Exam must be between 0 and 60");
    }
    const total = Number((assessment + exam).toFixed(2));
    let grade;
    if (total >= 70)
        grade = "A";
    else if (total >= 60)
        grade = "B";
    else if (total >= 50)
        grade = "C";
    else if (total >= 45)
        grade = "D";
    else if (total >= 40)
        grade = "E";
    else
        grade = "F";
    const remark = total >= 40 ? "Pass" : "Fail";
    return { total, grade, remark };
}
