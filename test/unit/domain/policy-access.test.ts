import {
  canMutateResource,
  canReadSession,
  canReadSpace,
  canReadTemplate,
} from "@/domain/policy/access";

describe("domain policy access", () => {
  describe("canReadSpace", () => {
    it("allows reads for open spaces and blocks private non-members", () => {
      expect(canReadSpace({ visibility: "OPEN", isMember: false })).toBe(true);
      expect(canReadSpace({ visibility: "PRIVATE", isMember: true })).toBe(true);
      expect(canReadSpace({ visibility: "PRIVATE", isMember: false })).toBe(false);
    });
  });

  describe("canMutateResource", () => {
    it("allows creator and space owner, blocks everyone else", () => {
      expect(
        canMutateResource({
          creatorId: "user_1",
          requestUserId: "user_1",
          isSpaceOwner: false,
        }),
      ).toBe(true);

      expect(
        canMutateResource({
          creatorId: "user_1",
          requestUserId: "user_2",
          isSpaceOwner: true,
        }),
      ).toBe(true);

      expect(
        canMutateResource({
          creatorId: "user_1",
          requestUserId: "user_2",
          isSpaceOwner: false,
        }),
      ).toBe(false);

      expect(
        canMutateResource({
          creatorId: "user_1",
          requestUserId: null,
          isSpaceOwner: true,
        }),
      ).toBe(false);
    });
  });

  describe("canReadSession", () => {
    it("applies personal and space session visibility rules", () => {
      expect(
        canReadSession({
          isSpaceScoped: true,
          spaceVisibility: "OPEN",
          isSpaceMember: false,
          isPrivate: true,
          isModeratedHidden: false,
          isOwner: false,
          isParticipant: false,
        }),
      ).toBe(true);

      expect(
        canReadSession({
          isSpaceScoped: true,
          spaceVisibility: "PRIVATE",
          isSpaceMember: false,
          isPrivate: true,
          isModeratedHidden: false,
          isOwner: false,
          isParticipant: false,
        }),
      ).toBe(false);

      expect(
        canReadSession({
          isSpaceScoped: false,
          spaceVisibility: null,
          isSpaceMember: false,
          isPrivate: false,
          isModeratedHidden: false,
          isOwner: false,
          isParticipant: false,
        }),
      ).toBe(true);

      expect(
        canReadSession({
          isSpaceScoped: false,
          spaceVisibility: null,
          isSpaceMember: false,
          isPrivate: true,
          isModeratedHidden: false,
          isOwner: false,
          isParticipant: false,
        }),
      ).toBe(false);

      expect(
        canReadSession({
          isSpaceScoped: false,
          spaceVisibility: null,
          isSpaceMember: false,
          isPrivate: true,
          isModeratedHidden: false,
          isOwner: true,
          isParticipant: false,
        }),
      ).toBe(true);

      expect(
        canReadSession({
          isSpaceScoped: false,
          spaceVisibility: null,
          isSpaceMember: false,
          isPrivate: false,
          isModeratedHidden: true,
          isOwner: false,
          isParticipant: false,
        }),
      ).toBe(false);
    });
  });

  describe("canReadTemplate", () => {
    it("honors hidden/public/space visibility constraints", () => {
      expect(
        canReadTemplate({
          isHidden: true,
          isModeratedHidden: false,
          isSpaceScoped: false,
          spaceVisibility: null,
          isSpaceMember: false,
          isPublic: true,
          isOwner: false,
        }),
      ).toBe(false);

      expect(
        canReadTemplate({
          isHidden: false,
          isModeratedHidden: false,
          isSpaceScoped: true,
          spaceVisibility: "OPEN",
          isSpaceMember: false,
          isPublic: false,
          isOwner: false,
        }),
      ).toBe(true);

      expect(
        canReadTemplate({
          isHidden: false,
          isModeratedHidden: false,
          isSpaceScoped: true,
          spaceVisibility: "PRIVATE",
          isSpaceMember: false,
          isPublic: false,
          isOwner: false,
        }),
      ).toBe(false);

      expect(
        canReadTemplate({
          isHidden: false,
          isModeratedHidden: false,
          isSpaceScoped: false,
          spaceVisibility: null,
          isSpaceMember: false,
          isPublic: true,
          isOwner: false,
        }),
      ).toBe(true);

      expect(
        canReadTemplate({
          isHidden: false,
          isModeratedHidden: false,
          isSpaceScoped: false,
          spaceVisibility: null,
          isSpaceMember: false,
          isPublic: false,
          isOwner: true,
        }),
      ).toBe(true);

      expect(
        canReadTemplate({
          isHidden: false,
          isModeratedHidden: true,
          isSpaceScoped: false,
          spaceVisibility: null,
          isSpaceMember: false,
          isPublic: true,
          isOwner: false,
        }),
      ).toBe(false);
    });
  });
});
