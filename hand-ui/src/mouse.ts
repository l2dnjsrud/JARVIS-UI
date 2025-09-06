export class MouseSynth {
  private x = 0;
  private y = 0;
  private over: Element | null = null;

  move(x: number, y: number): void {
    this.x = x; this.y = y;
    const el = document.elementFromPoint(x, y) ?? document.body;
    if (el !== this.over) {
      if (this.over) this.dispatch(this.over, "mouseout", { x, y });
      this.dispatch(el, "mouseover", { x, y });
      this.over = el;
    }
    this.dispatch(el, "mousemove", { x, y });
  }

  click(button: number = 0): void { this.down(button); this.up(button); }
  context(): void { this.dispatch(this.target(), "contextmenu", { x: this.x, y: this.y, button: 2 }); }
  down(button: number = 0): void { this.dispatch(this.target(), "mousedown", { x: this.x, y: this.y, button }); }
  up(button: number = 0): void {
    const el = this.target();
    this.dispatch(el, "mouseup", { x: this.x, y: this.y, button });
    if (button === 0) this.dispatch(el, "click", { x: this.x, y: this.y, button });
  }
  wheel(deltaY: number): void {
    this.target().dispatchEvent(new WheelEvent("wheel", {
      clientX: this.x, clientY: this.y, deltaY, bubbles: true
    }));
  }

  private target(): Element { return document.elementFromPoint(this.x, this.y) ?? document.body; }
  private dispatch(el: Element, type: string, p: { x: number; y: number; button?: number }): void {
    el.dispatchEvent(new MouseEvent(type, { clientX: p.x, clientY: p.y, button: p.button ?? 0, bubbles: true }));
  }
}