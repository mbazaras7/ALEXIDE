export const createPrismaMock = () => ({
  user: {
    findUnique: jest.fn(),
  },
});

export type PrismaMock = ReturnType<typeof createPrismaMock>;