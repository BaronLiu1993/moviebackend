import { Kafka } from "kafkajs";
import { insertImpressionEvent, insertInteractionEvents } from "../clickhouse/clickhouseService.js";

const brokers = [process.env.KAFKA_BROKER_URL || "localhost:9092"];

const kafka = new Kafka({ 
  clientId: "clickhouse-consumer", 
  brokers 
});

const consumer = kafka.consumer({ 
  groupId: "clickhouse-consumer-group" 
});

let running = false;

export async function startClickHouseConsumer() {
  if (running) return;
  running = true;

  await consumer.connect();
  await consumer.subscribe({ 
    topic: "recommendation-events", 
    fromBeginning: false 
  });

  console.log("[ClickHouse Consumer] Started, consuming from recommendation-events");
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value?.toString() || "{}");

        switch (payload.eventType) {
          case "impression":
            await insertImpressionEvent({
              userId: payload.userId,
              filmId: Number(payload.filmId),
              sessionId: payload.sessionId,
              genre_ids: payload.genre_ids || [],
              position: payload.position,
              surface: payload.surface,
            });
            break;

          case "interaction":
            await insertInteractionEvents({
              userId: payload.userId,
              tmdbId: Number(payload.tmdbId),
              name: payload.name,
              genre_ids: payload.genre_ids || [],
              interactionType: payload.interactionType,
              rating: payload.rating,
            });
            break;

          default:
            console.warn(`[ClickHouse Consumer] Unknown eventType: ${payload.eventType}`);
        }
      } catch (err) {
        console.error("[ClickHouse Consumer] Error processing message:", err);
      }
    },
  });
}

export async function stopClickHouseConsumer() {
  if (!running) return;
  await consumer.disconnect();
  running = false;
  console.log("[ClickHouse Consumer] Stopped");
}