import dotenv from "dotenv";
dotenv.config();

const TMDB_API_BASE = process.env.TMDB_API_BASE!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;

type TmdbDetail = {
  title: string;
  overview: string;
};


// refactor to handle errors more gracefully 
export const fetchTmdbOverview = async (
  tmdbId: number
): Promise<TmdbDetail | null> => {
  const headers = { Authorization: `Bearer ${TMDB_API_KEY}` };

  // Try TV first (primary content is Asian shows/K-dramas)
  try {
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
  } catch {
    throw new Error(`Failed to fetch TMDB details for ID ${tmdbId}`);
  }

  // Fallback to movie
  try {
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
  } catch {
    throw new Error(`Failed to fetch TMDB details for ID ${tmdbId}`);
  }

  return null
};
