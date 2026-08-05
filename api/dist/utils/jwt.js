// Purpose: JWT helpers for issuing and verifying access tokens.
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
export function signToken(payload) {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
    });
}
export function verifyToken(token) {
    return jwt.verify(token, env.JWT_SECRET);
}
