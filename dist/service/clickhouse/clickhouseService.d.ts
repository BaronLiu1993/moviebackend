interface Interaction {
    userId: string;
    filmId: number;
    name: string;
    genre: string[];
    interactionType: "click" | "impression" | "like";
    rating?: number;
}
export declare function insertEvent(event: Interaction): Promise<void>;
export {};
//# sourceMappingURL=clickhouseService.d.ts.map