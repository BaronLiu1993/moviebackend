import { createServerSideSupabaseClient } from "../service/supabase/configureSupabase.js";
import { buildFilmEmbeddingInput } from "./buildEmbeddingInput.js";
import { generateFilmEmbeddings } from "./generateEmbeddings.js";
import { EMBED_BATCH_DELAY_MS } from "../config/constants.js";
import log from "../lib/logger.js";

const BATCH_SIZE = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const embedFilms = async () => {
  const supabase = createServerSideSupabaseClient();

  // Fetch all Guanghai rows missing embeddings
  const { data: unembedded, error: fetchError } = await supabase
    .from("Guanghai")
    .select("tmdb_id, title, overview, genre_ids, release_year, media_type")
    .is("film_embedding", null);

  if (fetchError) {
    throw new Error(`Failed to fetch unembedded films: ${fetchError.message}`);
  }

  if (!unembedded || unembedded.length === 0) {
    log.info("No unembedded films found");
    return;
  }

  log.info({ count: unembedded.length }, "Found films to embed");

  const totalBatches = Math.ceil(unembedded.length / BATCH_SIZE);

  for (let i = 0; i < unembedded.length; i += BATCH_SIZE) {
    const batch = unembedded.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const inputs = batch.map(buildFilmEmbeddingInput);
    const embeddings = await generateFilmEmbeddings(inputs);

    // Update each film with its embedding
    for (let j = 0; j < batch.length; j++) {
      const { error: updateError } = await supabase
        .from("Guanghai")
        .update({ film_embedding: embeddings[j] })
        .eq("tmdb_id", batch[j]!.tmdb_id);

      if (updateError) {
        log.error({ tmdbId: batch[j]!.tmdb_id, err: updateError.message }, "Failed to update film embedding");
      }
    }

    log.info({ batchNum, totalBatches, count: batch.length }, "Embedded batch");

    if (i + BATCH_SIZE < unembedded.length) {
      await sleep(EMBED_BATCH_DELAY_MS);
    }
  }

  log.info({ embedded: unembedded.length }, "Embedding pipeline complete");
};
