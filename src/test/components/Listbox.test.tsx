import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Listbox, { type ListboxOption } from "@/components/Listbox";

const options: ListboxOption[] = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie" },
];

afterEach(cleanup);

function trigger() {
  return screen.getByRole("button", { name: /pick one/i });
}

describe("Listbox", () => {
  it("renders a real button, never a native select", () => {
    const { container } = render(
      <Listbox label="Pick one" options={options} value="a" onChange={vi.fn()} />,
    );
    // The whole point of this component: no OS-rendered dropdown anywhere.
    expect(container.querySelector("select")).toBeNull();
    expect(trigger()).toHaveAttribute("aria-haspopup", "listbox");
  });

  it("shows the selected option on the trigger", () => {
    render(<Listbox label="Pick one" options={options} value="b" onChange={vi.fn()} />);
    expect(trigger()).toHaveTextContent("Bravo");
  });

  it("opens and closes on trigger clicks", async () => {
    const user = userEvent.setup();
    render(<Listbox label="Pick one" options={options} value="a" onChange={vi.fn()} />);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.click(trigger());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    await user.click(trigger());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  // The regression that made this component necessary in shared form.
  it("reports the clicked option and closes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Listbox label="Pick one" options={options} value="a" onChange={onChange} />);

    await user.click(trigger());
    await user.click(within(screen.getByRole("listbox")).getByText("Charlie"));

    expect(onChange).toHaveBeenCalledWith("c");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports arrow keys and Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Listbox label="Pick one" options={options} value="a" onChange={onChange} />);

    trigger().focus();
    await user.keyboard("{ArrowDown}"); // open at "Alpha"
    await user.keyboard("{ArrowDown}"); // -> Bravo
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("closes on Escape and on an outside click, selecting nothing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <div>
        <Listbox label="Pick one" options={options} value="a" onChange={onChange} />
        <button type="button">elsewhere</button>
      </div>,
    );

    await user.click(trigger());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(trigger());
    await user.click(screen.getByRole("button", { name: "elsewhere" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("marks the selected option for assistive tech", async () => {
    const user = userEvent.setup();
    render(<Listbox label="Pick one" options={options} value="b" onChange={vi.fn()} />);

    await user.click(trigger());
    const selected = screen.getAllByRole("option", { selected: true });
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent("Bravo");
  });

  it("cannot be opened while disabled, and shows the busy label", async () => {
    const user = userEvent.setup();
    render(
      <Listbox
        label="Pick one"
        options={options}
        value="a"
        onChange={vi.fn()}
        disabled
        busyLabel="Working…"
      />,
    );

    expect(trigger()).toBeDisabled();
    expect(trigger()).toHaveTextContent("Working…");
    await user.click(trigger());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
