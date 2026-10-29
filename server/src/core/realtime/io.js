let io = null;

module.exports = {
  getIo: () => io,
  setIo: (instance) => {
    io = instance;
  },
};
