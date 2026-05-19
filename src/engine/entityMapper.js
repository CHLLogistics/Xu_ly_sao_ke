export function applyEntityMapping(ruleResult, dmDoiTuong) {
    let resultUpper = ruleResult.toUpperCase();
    let exactMatch = dmDoiTuong.find(r => r.keyword.toUpperCase() === resultUpper);
    if (exactMatch) return { code: exactMatch.code, keyword: exactMatch.keyword };

    // Word boundary mapping match (Fixed to avoid .includes false positives)
    let partialMatch = dmDoiTuong.find(r => {
        let kw = r.keyword.toUpperCase();
        let escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Quy tắc Regex an toàn cho danh từ tiếng Việt (không dính chữ)
        return new RegExp('(^|[^a-zA-Z0-9_À-ỹ])' + escapedKw + '([^a-zA-Z0-9_À-ỹ]|$)', 'i').test(resultUpper);
    });

    return partialMatch ? { code: partialMatch.code, keyword: partialMatch.keyword } : { code: "CHECK_AGAIN", keyword: "" };
}
