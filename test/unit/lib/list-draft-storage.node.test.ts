import { createListEditorDraftSnapshot, LocalListDraftStore } from "@/lib/list-draft-storage";

describe("list-draft-storage on server", () => {
  it("no-ops without window", () => {
    const store = new LocalListDraftStore();
    const context = { userId: "user_1", scopeId: "list-editor:create:personal" };
    const snapshot = createListEditorDraftSnapshot({
      name: "Draft",
      description: "",
      isPublic: false,
      items: [],
    });

    expect(store.load(context)).toBeNull();
    expect(() => store.save(context, snapshot)).not.toThrow();
    expect(() => store.clear(context)).not.toThrow();
  });
});
