# Pixarrón password `+` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Que alumnos con `+` en la clave puedan autenticarse vía Pixarrón desde MOL.

**Architecture:** En `fetchPixarronAcceso`, sustituir U+002B por U+FF0B solo al armar el path; mejorar el mensaje si Pixarrón responde 404 HTML.

**Tech Stack:** TypeScript, `node:test` + tsx, Docker `autenticacion-api` en mol-dev.

## Global Constraints

- Solo cambia `autenticacion-uniacc-api-docker`.
- No loguear la clave.
- Deploy primero mol-dev; prod después si el usuario lo pide.

---

### Task 1: Helper + tests

- [ ] Test: `claveParaPathPixarron('a+b')` → contiene U+FF0B, no U+002B
- [ ] Test: mensaje 404 HTML distinto al de proxy
- [ ] Implementar helper y usarlo en `pixarronAcceso.ts`
- [ ] `node --import tsx --test src/api/pixarronAcceso.test.ts` en verde

### Task 2: Deploy mol-dev

- [ ] Rebuild `autenticacion-api` en este host
- [ ] Smoke: llamada Pixarrón con `Kenny`/`Sebastian10+` vía el módulo o login
