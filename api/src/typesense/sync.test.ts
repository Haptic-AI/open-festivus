import { describe, expect, it } from "vitest"
import { documentId, flattenForSearch, isSearchable } from "./sync.js"

describe("typesense/sync", () => {
  it("flattens a robot record into a Typesense doc", () => {
    const doc = flattenForSearch("robots", "franka-panda", {
      slug: "franka-panda",
      name: "Franka Panda",
      description: "7-DOF arm",
      tags: ["arm", "research"],
      vendor: "Franka",
    })
    expect(doc.id).toBe("robots:franka-panda")
    expect(doc["table"]).toBe("robots")
    expect(doc["slug"]).toBe("franka-panda")
    expect(doc["name"]).toBe("Franka Panda")
    expect(doc["description"]).toBe("7-DOF arm")
    expect(doc["tags"]).toEqual(["arm", "research"])
    expect(doc["data"]).toMatchObject({ vendor: "Franka" })
  })

  it("falls back to title when name is missing", () => {
    const doc = flattenForSearch("papers", "x-arxiv", {
      slug: "x-arxiv",
      title: "Some title",
    })
    expect(doc["name"]).toBe("Some title")
  })

  it("omits empty optional fields", () => {
    const doc = flattenForSearch("robots", "x", { slug: "x" })
    expect(doc["name"]).toBeUndefined()
    expect(doc["description"]).toBeUndefined()
    expect(doc["tags"]).toBeUndefined()
  })

  it("only flags searchable tables", () => {
    expect(isSearchable("robots")).toBe(true)
    expect(isSearchable("compatibility_edges")).toBe(false)
  })

  it("documentId is deterministic", () => {
    expect(documentId("policies", "act-base")).toBe("policies:act-base")
  })
})
