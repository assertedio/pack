const { expect } = require('chai');
const shortid = require('shortid');

describe('simple tests', () => {
  it('basic', () => {
    expect(typeof (shortid.generate()) === 'string').to.eql(true);
  });
});
