import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "recommendation-events-streaming",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer();
let isConnected = false;

export async function initProducer() {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
    console.log("[Kafka] Producer connected");
  }
}

export async function sendEventToKafka(topic: string, event: object) {
  try {
    await initProducer();
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(event) }],
    });
    console.log(`[Kafka] Event sent to topic ${topic}:`, event);
  } catch (err) {
    console.error(`[Kafka] Failed to send event to topic ${topic}:`, err);
  }
}

export async function disconnectProducer() {
  if (isConnected) {
    await producer.disconnect();
    isConnected = false;
  }
}
