import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "recommendation-events-streaming",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer();

/*
await producer.connect();
await producer.send({
  topic: "test-topic",
  messages: [{ value: "" }],
});
await producer.disconnect();
*/
