---
path: "/tutorial/contents"
title: "Custom Content Types"
---

At some point while working with Irmin, you might want to move beyond using
the default content types.

This section will explain how custom datatypes can be implemented using
[`Irmin.Type`][irmin.type]. Before continuing with these examples, make sure to
read through the [official documentation][irmin.type], as it contains information
about the predefined types and how they're used.

Now that you've read through that documentation, let's create some contents by
defining the functions required by the [Irmin.Contents.S] interface. This
section will walk you through a few different examples:

- [Counter](#counter)
- [Record](#record)
- [Association List](#association-list)
- [LWW register](#lww-register)

## Overview

To create a content type, you need to define the following:

- A type `t`
- A value `t` of type `t Irmin.Type.t`
- A function `merge`, which performs a three-way merge over values of type `t`

## Counter

A counter is just a simple `int64` value that can be incremented and
decremented. When counters are merged, the values will be added together.

To get started, you will need to define a type `t` and build a value `t` using
the functions provided in [`Irmin.Type`]. In this case, all we need is the existing
`int64` value, but in most cases, it won't be this simple!

```ocaml
module Counter: Irmin.Contents.S with type t = int64 = struct
	type t = int64
	let t = Irmin.Type.int64
```

Now we need to define a merge function. There is already a `counter`
implementation available in [`Irmin.Merge`][irmin.merge], so you wouldn't actually
need to write this yourself:

```ocaml
	let merge ~old a b =
	    let open Irmin.Merge.Infix in
		  old () >|=* fun old ->
      let old = match old with None -> 0L | Some o -> o in
      let (+) = Int64.add and (-) = Int64.sub in
      a + b - old
```

```ocaml
  let merge = Irmin.Merge.(option (v t merge))
end
```

If we were to leverage the existing implementation, it would be even simpler:

```ocaml
let merge = Irmin.Merge.(option counter)
```

Now this `Counter` module can be used as the contents of an Irmin store:

```ocaml
module Counter_mem_store = Irmin_mem.KV.Make(Counter)
```

## Record

In this example, let's wrap a record type so Irmin can store it directly.

Here is a `car` type that we will use as the content type of our store:

```ocaml
type color =
    | Black
    | White
    | Other of string
type car = {
    license: string;
    year: int32;
    make_and_model: string * string;
    color: color;
    owner: string;
}
```

First, `color` has to be wrapped. Variants are modeled using the
[`variant`][irmin.type-variant] function:

```ocaml
module Car = struct
    type t  = car
    let color =
        let open Irmin.Type in
        variant "color" (fun black white other -> function
            | Black -> black
            | White -> white
            | Other color -> other color)
        |~ case0 "Black" Black
        |~ case0 "White" White
        |~ case1 "Other" string (fun s -> Other s)
        |> sealv
```

This maps variant cases to their names in string representation. Records
are handled similarly:

```ocaml
    let t =
        let open Irmin.Type in
        record "car" (fun license year make_and_model color owner ->
            {license; year; make_and_model; color; owner})
        |+ field "license" string (fun t -> t.license)
        |+ field "year" int32 (fun t -> t.year)
        |+ field "make_and_model" (pair string string) (fun t -> t.make_and_model)
        |+ field "color" color (fun t -> t.color)
        |+ field "owner" string (fun t -> t.owner)
        |> sealr
```

Here's the merge operation:

```ocaml
    let merge = Irmin.Merge.(option (idempotent t))
end
```

Now some with examples using `car`, we will map a Vehicle Identification Number (VIN) to a
car record. This could be used by a tow company or an auto shop to identify
cars, for example:

```ocaml
open Lwt.Syntax
module Car_store = Irmin_mem.KV.Make(Car)
module Car_info = Irmin_unix.Info(Car_store.Info)

let car_a = {
    color = Other "green";
    license = "ABCD123";
    year = 2002l;
    make_and_model = ("Honda", "Accord");
    owner = "Jane Doe";
}

let car_b = {
    color = Black;
    license = "MYCAR00";
    year = 2016l;
    make_and_model = ("Toyota", "Corolla");
    owner = "Mike Jones";
}

let add_car store car_number car =
    let info = Car_info.v "added %s" car_number in
    Car_store.set_exn store [car_number] car ~info

let main =
    let config = Irmin_mem.config () in
    let* repo = Car_store.Repo.v config in
    let* t = Car_store.main repo in
    let* () = add_car t "5Y2SR67049Z456146" car_a in
    let* () = add_car t "2FAFP71W65X110910" car_b in
    let+ car = Car_store.get t ["2FAFP71W65X110910"] in
    assert (car.license = car_b.license);
    assert (car.year = car_b.year)

let () = Lwt_main.run main
```

## Association List

In the following example, we will define an association list that maps string keys to
string values. The type itself is not very complicated, but the merge function
is even more complex than the previous two examples.

Like the two examples above, you must define a `t` type and a `t` value of
type `Irmin.Type.t` to begin:

```ocaml
module Object = struct
    type t = (string * string) list
    let t = Irmin.Type.(list (pair string string))
```

So far so good! Irmin provides a simple way to model a list of pairs!

To write the merge function, we can leverage `Irmin.Merge.alist`, which
simplifies this process for association lists. In this example, we use
strings for both the keys and values; however, in most other cases, `alist` can
get a bit more complicated since it requires existing merge functions for both
the key and value types. For a slightly more complicated example, read
through `merge_object` and `merge_value` in [`contents.ml`][irmin.contents], which
are used to implement JSON contents for Irmin.

```ocaml
    let merge_alist =
        Irmin.Merge.(alist Irmin.Type.string Irmin.Type.string (fun _key -> option string))
    let merge = Irmin.Merge.(option merge_alist)
end
```

## LWW Register

A last-write-wins (LWW)) register is similar to a basic Irmin store; except on merge,
the most recently written value will be picked rather than trying to merge the
values.

First, this requires a way to get a timestamp. We will make this as generic as
possible, so it can be used on Unix or MirageOS:

```ocaml
module type TIMESTAMP = sig
    val now: unit -> int64
end
```

On Unix this can be implemented using `Unix.gettimeofday`:

```ocaml
module Timestamp = struct
    let now () = Int64.of_float @@ Unix.gettimeofday () *. 100000.
end
```

`Lww_register` will be defined as a functor that wraps an existing content type:

```ocaml
module Lww_register (Time: TIMESTAMP) (C: Irmin.Type.S) = struct
    type t = C.t * int64
    let t =
        Irmin.Type.(pair C.t int64)
```

Here's a convenient function for adding a timestamp to a `C.t` value:

```ocaml
    let v c = (c, Time.now ())
```

The merge operation for `Lww_register` is slightly different than the ones
covered so far. It will not attempt to merge any values. Instead, it will pick
the newest value based on the attached timestamp.

```ocaml
    let merge ~old:_ (a, timestamp_a) (b, timestamp_b) =
        match Int64.compare timestamp_a timestamp_b with
        | 0 ->
            if Irmin.Type.(unstage (equal C.t)) a b then
                Irmin.Merge.ok (a, timestamp_a)
            else
                let msg = "Conflicting entries have the same timestamp but different values" in
                Irmin.Merge.conflict "%s" msg
        | 1 -> Irmin.Merge.ok (a, timestamp_a)
        | _ -> Irmin.Merge.ok (b, timestamp_b)
    let merge = Irmin.Merge.(option (v t merge))
end
```

An example using `Lww_register`:

```ocaml
open Lwt.Syntax
module Value = Lww_register (Timestamp) (Irmin.Contents.String)
module S = Irmin_mem.KV.Make (Value)
module I = Irmin_unix.Info(S.Info)

let main =
    (* Configure the repo *)
    let cfg = Irmin_mem.config () in
    (* Access the main branch *)
    let* repo = S.Repo.v cfg in
    let* main = S.main repo in
    (* Set [foo] to ["bar"] on main branch *)
    let* () = S.set_exn main ["foo"] (Value.v "bar") ~info:(I.v "set foo on main branch") in
    (* Access example branch *)
    let* example = S.of_branch repo "example" in
    (* Set [foo] to ["baz"] on example branch *)
    let* () = S.set_exn example ["foo"] (Value.v "baz") ~info:(I.v "set foo on example branch") in
    (* Merge the example into main branch *)
    let* m = S.merge_into ~into:main example ~info:(I.v "merge example into main") in
    match m with
    | Ok () ->
        (* Check that [foo] is set to ["baz"] after the merge *)
        let+ (foo, _) = S.get main ["foo"] in
        assert (foo = "baz")
    | Error conflict ->
        let fmt = Irmin.Type.pp_json Irmin.Merge.conflict_t in
        Lwt_io.printl (Fmt.to_to_string fmt conflict)

let () = Lwt_main.run main
```

If you'd like another example, check out the [custom
merge][examples/custom-merge] example in the Irmin repository. It illustrates
how to write a mergeable log.

<!-- prettier-ignore-start -->
[irmin.type]: https://mirage.github.io/repr/repr/Repr/index.html
[irmin.type-variant]: https://mirage.github.io/repr/repr/Repr/index.html#val-variant
[irmin.contents]: https://github.com/mirage/irmin/blob/main/src/irmin/contents.ml
[irmin.contents.s]: https://mirage.github.io/irmin/irmin/Irmin/Contents/module-type-S/index.html
[irmin.merge]: https://mirage.github.io/irmin/irmin/Irmin/Merge/index.html

[examples/custom-merge]: https://github.com/mirage/irmin/blob/main/examples/custom_merge.ml
<!-- prettier-ignore-end -->
