import { filterResults } from "../../../src/functions/utils/filterResults";

describe("filterResults utility function", () => {
  it("it correctly counts the number of results that were successful, failed, or errored", async () => {
    const { successful, failed, errored } = filterResults<string>(
      await Promise.allSettled([
        Promise.resolve({ object: "test", success: true }),
        Promise.resolve({ object: "test2", success: true }),
        Promise.resolve({ object: "test3", success: false }),
        Promise.resolve({ object: "test4", success: false }),
        Promise.resolve({ object: "test5", success: false }),
        Promise.reject(new Error("API Error")),
        Promise.reject("API Error"),
        Promise.reject([new Error("API Error"), new Error("API Error 2")]),
        Promise.reject(["API Error", "API Error 2"]),
      ]),
    );

    expect(successful.count).toEqual(2);
    expect(failed.count).toEqual(3);
    expect(errored.count).toEqual(4);
  });

  it("it returns the correct objects for successful results", async () => {
    const success1 = "test";
    const success2 = "test2";
    const { successful } = filterResults<string>(
      await Promise.allSettled([
        Promise.resolve({ object: success1, success: true }),
        Promise.resolve({ object: success2, success: true }),
        Promise.resolve({ object: "test3", success: false }),
        Promise.resolve({ object: "test4", success: false }),
        Promise.resolve({ object: "test5", success: false }),
      ]),
    );

    expect(successful.objects).toEqual([success1, success2]);
  });

  it("it returns the correct objects for failed results", async () => {
    const failed1 = "test3";
    const failed2 = "test4";
    const failed3 = "test5";
    const { failed } = filterResults<string>(
      await Promise.allSettled([
        Promise.resolve({ object: "test", success: true }),
        Promise.resolve({ object: "test2", success: true }),
        Promise.resolve({ object: failed1, success: false }),
        Promise.resolve({ object: failed2, success: false }),
        Promise.resolve({ object: failed3, success: false }),
      ]),
    );

    expect(failed.objects).toEqual([failed1, failed2, failed3]);
  });

  it("it returns a unique set of error messages for errored results that reject with a single Error", async () => {
    const error1 = new Error("Test Error 1");
    const error2 = new Error("Test Error 2");
    const error3 = new Error("Test Error 3");
    const { errored } = filterResults<string>(
      await Promise.allSettled([
        Promise.reject(error1),
        Promise.reject(error1),
        Promise.reject(error2),
        Promise.reject(error3),
        Promise.reject(error3),
      ]),
    );

    expect(errored.errors).toEqual([
      error1.message,
      error2.message,
      error3.message,
    ]);
  });

  it("it returns a unique set of error messages for errored results that reject with a multiple Errors", async () => {
    const error1 = new Error("Test Error 1");
    const error2 = new Error("Test Error 2");
    const error3 = new Error("Test Error 3");
    const { errored } = filterResults<string>(
      await Promise.allSettled([
        Promise.reject([error1, error1]),
        Promise.reject([error1, error2]),
        Promise.reject([error2, error3]),
        Promise.reject([error3, error3]),
        Promise.reject([error3, error1]),
      ]),
    );

    expect(errored.errors).toEqual([
      error1.message,
      error2.message,
      error3.message,
    ]);
  });

  it("it returns a unique set of error messages for errored results that reject with a single primitive", async () => {
    const error1 = "Test Error 1";
    const error2 = 1;
    const error3 = true;
    const { errored } = filterResults<string>(
      await Promise.allSettled([
        Promise.reject(error1),
        Promise.reject(error1),
        Promise.reject(error2),
        Promise.reject(error3),
        Promise.reject(error3),
      ]),
    );

    expect(errored.errors).toEqual([error1, error2, error3]);
  });

  it("it returns a unique set of error messages for errored results that reject with multiple primitives", async () => {
    const error1 = "Test Error 1";
    const error2 = 1;
    const error3 = true;
    const { errored } = filterResults<string>(
      await Promise.allSettled([
        Promise.reject([error1, error1]),
        Promise.reject([error1, error2]),
        Promise.reject([error2, error3]),
        Promise.reject([error3, error3]),
        Promise.reject([error3, error1]),
      ]),
    );

    expect(errored.errors).toEqual([error1, error2, error3]);
  });
});
