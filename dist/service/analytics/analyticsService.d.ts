import type { UUID } from "node:crypto";
type KafkaEvent = {
    userId: UUID;
    filmId: number;
    name: string;
    genre: string[];
};
type KafkaRatingEvent = {
    userId: UUID;
    filmId: number;
    rating: number;
    name: string;
    genre: string[];
};
export declare const handleLike: ({ userId, filmId, name, genre, }: KafkaEvent) => Promise<void>;
export declare const handleRating: ({ userId, filmId, name, genre, rating, }: KafkaRatingEvent) => Promise<void>;
export declare const handleClick: ({ userId, filmId, name, genre, }: KafkaEvent) => Promise<void>;
export declare const handleImpression: ({ userId, filmId, name, genre, }: KafkaEvent) => Promise<void>;
export {};
//# sourceMappingURL=analyticsService.d.ts.map