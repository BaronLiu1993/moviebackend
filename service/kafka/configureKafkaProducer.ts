import { Kafka, Partitioners } from "kafkajs";

const brokers = [process.env.KAFKA_BROKER_URL || "localhost:9092"];

const kafka = new Kafka({
  clientId: "clickhouse-producer",
  brokers
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});

let isConnected = false;

export async function initProducer(retries = 6, delayMs = 2000) {
  if (isConnected) return;
  for (let i = 0; i < retries; i++) {
    try {
      await producer.connect();
      isConnected = true;
      console.log("[Kafka] Producer connected");
      return;
    } catch (err) {
      console.warn(`[Kafka] Connect attempt ${i + 1} failed, retrying in ${delayMs}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Failed to connect Kafka producer after retries");
}

// Add topics to parameters after this
export async function sendEventToKafkaRecommendations(event: object) {
  try {
    await initProducer();
    await producer.send({
      topic: "recommendation-events",
      messages: [{ value: JSON.stringify(event) }],
    });
    console.log(`[Kafka] Event sent to topic:`, event);
  } catch (err) {
    console.error(`[Kafka] Failed to send event to topic:`, err);
  }
}

export async function disconnectProducer() {
  if (isConnected) {
    await producer.disconnect();
    isConnected = false;
    console.log("[Kafka] Producer disconnected");
  }
}
