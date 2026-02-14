import { Kafka } from "kafkajs";
import { insertEvent } from "../clickhouse/clickhouseService.js";

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

  console.log("[ClickHouse Consumer] ✅ Started, consuming from recommendation-events");
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value?.toString() || "{}");
        await insertEvent({
          userId: payload.userId,
          filmId: Number(payload.filmId),
          name: payload.name,
          genre: payload.genres || [],
          interactionType: payload.interactionType,
          rating: payload.rating,
        });

        console.log(`[ClickHouse Consumer] ✅ Processed ${payload.interactionType} for user ${payload.userId}`);
      } catch (err) {
        console.error("[ClickHouse Consumer] ❌ Error processing message:", err);
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