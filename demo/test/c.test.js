import { expect } from '@bundled-es-modules/chai';

describe('test c', () => {
  it('undefined is not a function', () => {
    expect(undefined).to.not.be.a('function');
  });

  it('true equals true', () => {
    expect(true).to.equal(true);
  });
});
