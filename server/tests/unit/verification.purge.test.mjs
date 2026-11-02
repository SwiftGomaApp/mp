import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadWithMocks } from "../helpers/mockModules.mjs";

const order = [];

const prisma = {
  verificationDocument: {
    findMany: vi.fn(async () => [{ storageId: "verification/c1/ID_CARD" }, { storageId: "verification/c1/SELFIE" }]),
  },
  verificationCase: {
    deleteMany: vi.fn(async () => (order.push("rows"), { count: 1 })),
  },
};
const removeStoredDocument = vi.fn(async (id) => order.push(`file:${id}`));

const { purgeVerification } = loadWithMocks("features/verification/services/purge.service.js", {
  "core/db/prisma.js": { getPrisma: () => prisma },
  "features/verification/utils/verification.storage.js": { removeStoredDocument },
});

beforeEach(() => {
  order.length = 0;
  vi.clearAllMocks();
});

describe("verification purge", () => {
  it("removes every stored file, then the rows", async () => {
    expect(await purgeVerification("user-1")).toBe(1);

    expect(prisma.verificationDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { case: { userId: "user-1" } } }),
    );
    expect(order).toEqual([
      "file:verification/c1/ID_CARD",
      "file:verification/c1/SELFIE",
      "rows",
    ]);
    expect(prisma.verificationCase.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("keeps the rows when a file cannot be removed, so the purge can be retried", async () => {
    removeStoredDocument.mockRejectedValueOnce(new Error("cloudinary down"));

    await expect(purgeVerification("user-1")).rejects.toThrow("cloudinary down");
    expect(prisma.verificationCase.deleteMany).not.toHaveBeenCalled();
  });

  it("does nothing for a person without a dossier", async () => {
    prisma.verificationDocument.findMany.mockResolvedValueOnce([]);
    prisma.verificationCase.deleteMany.mockResolvedValueOnce({ count: 0 });

    expect(await purgeVerification("user-2")).toBe(0);
    expect(removeStoredDocument).not.toHaveBeenCalled();
  });
});
