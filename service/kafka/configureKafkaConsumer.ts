import { Kafka } from "kafkajs";
import { insertImpressionEvent, insertInteractionEvents } from "../clickhouse/clickhouseService.js";

const brokers = [process.env.KAFKA_BROKER_URL || "localhost:9092"];

const kafka = new Kafka({ 
  clientId: "clickhouse-consumer", 
  brokers 
});

const interactionConsumer = kafka.consumer({ 
  groupId: "interaction-consumer-group" 
});

const impressionConsumer = kafka.consumer({ 
  groupId: "impression-consumer-group" 
});

let interactionRunning = false;
let impressionRunning = false;

export async function startInteractionConsumer() {
  if (interactionRunning) return;
  interactionRunning = true;

  await interactionConsumer.connect();
  await interactionConsumer.subscribe({ 
    topic: "interaction-events", 
    fromBeginning: false 
  });

  console.log("[Interaction Consumer] Started, consuming from interaction-events");
  await interactionConsumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value?.toString() || "{}");
        await insertInteractionEvents({
          userId: payload.userId,
          tmdbId: Number(payload.tmdbId),
          name: payload.name,
          genre_ids: payload.genre_ids || [],
          interactionType: payload.interactionType,
          rating: payload.rating,
        });
      } catch (err) {
        console.error("[Interaction Consumer] Error processing message:", err);
      }
    },
  });
}

export async function startImpressionConsumer() {
  if (impressionRunning) return;
  impressionRunning = true;

  await impressionConsumer.connect();
  await impressionConsumer.subscribe({ 
    topic: "impression-events", 
    fromBeginning: false 
  });

  console.log("[Impression Consumer] Started, consuming from impression-events");
  await impressionConsumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value?.toString() || "{}");
        await insertImpressionEvent({
          userId: payload.userId,
          filmId: Number(payload.filmId),
          sessionId: payload.sessionId,
          genre_ids: payload.genre_ids || [],
          position: payload.position,
          surface: payload.surface,
        });
      } catch (err) {
        console.error("[Impression Consumer] Error processing message:", err);
      }
    },
  });
}

export async function stopInteractionConsumer() {
  if (!interactionRunning) return;
  await interactionConsumer.disconnect();
  interactionRunning = false;
  console.log("[Interaction Consumer] Stopped");
}

export async function stopImpressionConsumer() {
  if (!impressionRunning) return;
  await impressionConsumer.disconnect();
  impressionRunning = false;
  console.log("[Impression Consumer] Stopped");
}