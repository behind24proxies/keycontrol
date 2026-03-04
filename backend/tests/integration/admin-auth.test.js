import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import { ADMIN_PASSWORD } from "../helpers/constants.js";

describe("Admin Auth", () => {
  let app;

  beforeAll(async () => {
    ({ app } = await createTestEnv());
  });

  describe("POST /api/auth/login", () => {
    it("should return a JWT when given a valid password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: ADMIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe("string");
    });

    it("should return password_is_initial flag", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: ADMIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.password_is_initial).toBe(true);
    });

    it("should reject an invalid password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: "wrong-password" });

      expect(res.status).toBe(401);
    });

    it("should reject an empty password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: "" });

      expect(res.status).toBe(400);
    });

    it("should reject missing password field", async () => {
      const res = await request(app).post("/api/auth/login").send({});

      expect(res.status).toBe(400);
    });
  });

  describe("Protected routes", () => {
    it("should allow access to admin routes with valid JWT", async () => {
      // First, get a JWT
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ password: ADMIN_PASSWORD });

      const jwt = loginRes.body.token;

      // Use the JWT to access a protected route
      const res = await request(app)
        .get("/api/resources")
        .set("Authorization", `Bearer ${jwt}`);

      expect(res.status).toBe(200);
    });

    it("should reject access without Authorization header", async () => {
      const res = await request(app).get("/api/resources");

      expect(res.status).toBe(401);
    });

    it("should reject access with invalid JWT", async () => {
      const res = await request(app)
        .get("/api/resources")
        .set("Authorization", "Bearer invalid-jwt-token");

      expect(res.status).toBe(401);
    });
  });
});
