import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import { ADMIN_TOKEN } from "../helpers/constants.js";

describe("Admin Auth", () => {
  let app;

  beforeAll(async () => {
    ({ app } = await createTestEnv());
  });

  describe("POST /api/auth/login", () => {
    it("should return a JWT when given a valid admin token", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ token: ADMIN_TOKEN });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe("string");
    });

    it("should reject an invalid admin token", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ token: "wrong-token" });

      expect(res.status).toBe(401);
    });

    it("should reject an empty token", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ token: "" });

      expect(res.status).toBe(400);
    });

    it("should reject missing token field", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe("Protected routes", () => {
    it("should allow access to admin routes with valid JWT", async () => {
      // First, get a JWT
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ token: ADMIN_TOKEN });

      const jwt = loginRes.body.token;

      // Use the JWT to access a protected route
      const res = await request(app)
        .get("/api/projects")
        .set("Authorization", `Bearer ${jwt}`);

      expect(res.status).toBe(200);
    });

    it("should reject access without Authorization header", async () => {
      const res = await request(app).get("/api/projects");

      expect(res.status).toBe(401);
    });

    it("should reject access with invalid JWT", async () => {
      const res = await request(app)
        .get("/api/projects")
        .set("Authorization", "Bearer invalid-jwt-token");

      expect(res.status).toBe(401);
    });
  });
});
