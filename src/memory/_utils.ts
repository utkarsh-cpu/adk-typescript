
export function formatTimestamp(timestamp: number): string {
    // Convert seconds to milliseconds if needed
    const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
    return new Date(ms).toISOString();
}
