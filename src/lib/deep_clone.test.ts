import { deepClone } from './deep_clone';

class Foo {
  public bar = true;
}

describe('Test deepClone()', () => {
  test('Number is cloned', () => {
    const x = 9;
    const y = deepClone(x);

    expect(x).toBe(y);
  });

  test('String is cloned', () => {
    const str = 'Hello World';
    const str2 = deepClone(str);

    expect(str).toBe(str2);
  });

  test('Boolean is cloned', () => {
    const a = false;
    const b = deepClone(a);

    expect(b).toBe(false);
  });

  test('Null is cloned', () => {
    const a = null;
    const b = deepClone(a);

    expect(b).toBeNull();
  });

  test('Undefined is cloned', () => {
    let a : undefined;
    const b = deepClone(a);

    expect(b).toBeUndefined();
  });

  test('Date is cloned', () => {
    const a = new Date(1602835553);
    const b = deepClone(a);

    // Check that the value match
    expect(a.getTime()).toBe(b.getTime());

    // Modify the value of one date and expect they are different
    b.setTime(0);

    expect(b.getTime()).toBe(0);
    expect(a.getTime()).not.toBe(0);
  });

  test('Function is copied by reference', () => {
    const foo = () => 'abc';

    const a = foo;
    const b = deepClone(a);

    expect(a()).toBe('abc');
    expect(b()).toBe('abc');
  });

  test('Class instance is copied by reference', () => {
    const a = new Foo();
    const b = deepClone(a);

    // If the object is copied by reference, the variables point to the same object
    a.bar = false;

    expect(b.bar).toBe(false);

    // TODO: Embed an object literal, change its member and test that the original values are intact
  });

  test('Array is cloned', () => {
    const arr = ['a', 'b', 'c', 'd'];
    const arrCopy = deepClone(arr);

    // Test that array match value by value
    expect(arrCopy).toEqual(arr);

    // Test that changing values of the copy does not change the original array
    arrCopy[0] = 'A';
    expect(arr[0]).toBe('a');
  });

  test('Multi-level object literal is cloned', () => {
    const x = {
      a: 1,
      b: 1,
      c: {
        c1: 1,
        c2: 1,
      },
      d: {
        dd1: {
          ddd1: 1,
          ddd2: 1,
          ddd3: () => 'abc',
        },
        dd2: [[1, 1, 1], [1, 1, 1]],
        dd3: new Date(1602835553),
      },
    };

    const y = deepClone(x);

    // Expect that the values where properly copied
    expect(x).toEqual(y);

    // Modify values of the y object at every level of depth
    y.a = 2;
    expect(x.a).toBe(1);

    y.c.c1 = 2;
    expect(x.c.c1).toBe(1);

    y.d.dd1.ddd1 = 2;
    expect(x.d.dd1.ddd1).toBe(1);

    y.d.dd2[1][1] = 2;
    expect(x.d.dd2[1][1]).toBe(1);

    y.d.dd3.setTime(0);
    expect(x.d.dd3.getTime()).toBe(1602835553);

    expect(y.d.dd1.ddd3()).toBe('abc');
  });
});
