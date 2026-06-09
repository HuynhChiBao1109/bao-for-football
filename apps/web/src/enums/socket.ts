export const ESocketEvent = {
    MATCH_JOIN: 'match:join',
    MATCH_LEAVE: 'match:leave',
    MATCH_SNAPSHOT: 'match:snapshot',
    MATCH_EVENT: 'match:event',
    MATCH_COMPLETED: 'match:completed',
} as const;
    
export type ESocketEvent = (typeof ESocketEvent)[keyof typeof ESocketEvent];