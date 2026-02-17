import dotenv from "dotenv";
dotenv.config();

const TMDB_API_BASE = process.env.TMDB_API_BASE!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;

type TmdbDetail = {
  title: string;
  overview: string;
};

type TmdbKeyword = {
  id: number;
  name: string;
};


// refactor to handle errors more gracefully 
export const fetchTmdbOverview = async (
  tmdbId: number
): Promise<TmdbDetail> => {
  const headers = { Authorization: `Bearer ${TMDB_API_KEY}` };

  const tvRes = await fetch(
    `${TMDB_API_BASE}/3/tv/${tmdbId}?language=en-US`,
    { headers }
  );
  if (tvRes.ok) {
    const data = await tvRes.json();
    console.log(data)
    return {
      title: data.name || data.original_name || "",
      overview: data.overview || "",
    };
  }


  const movieRes = await fetch(
    `${TMDB_API_BASE}/3/movie/${tmdbId}?language=en-US`,
    { headers }
  );
  if (movieRes.ok) {
    const data = await movieRes.json();
    console.log(data)
    return {
      title: data.title || data.name || "",
      overview: data.overview || "",
    };
  }

  throw new Error(`TMDB details not found for ID ${tmdbId}`);
};

export const fetchTmdbKeywords = async (
  tmdbId: number
): Promise<string[]> => {
  const headers = { Authorization: `Bearer ${TMDB_API_KEY}` };

    const tvRes = await fetch(
      `${TMDB_API_BASE}/3/tv/${tmdbId}/keywords`,
      { headers }
    );
    if (tvRes.ok) {
      const data = await tvRes.json() as { results?: TmdbKeyword[] };
      if (data.results && data.results.length > 0) {
        return data.results.map((k: TmdbKeyword) => k.name);
      }
    }

    const movieRes = await fetch(
      `${TMDB_API_BASE}/3/movie/${tmdbId}/keywords`,
      { headers }
    );
    if (movieRes.ok) {
      const data = await movieRes.json() as { keywords?: TmdbKeyword[] };
      if (data.keywords && data.keywords.length > 0) {
        return data.keywords.map((k: TmdbKeyword) => k.name);
      }
    }

    throw new Error(`TMDB keywords not found for ID ${tmdbId}`);
};
