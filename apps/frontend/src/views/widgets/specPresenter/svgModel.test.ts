import { describe, expect, it } from 'vitest';
import { frameHeight, readRef, sanitizeSvg, type SanitizedSvg } from './svgModel';

const svg = (body: string, attributes = 'width="200" height="100"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${attributes}>${body}</svg>`;

const parse = (sanitized: SanitizedSvg | undefined) => {
  if (sanitized === undefined) throw new Error('not sanitized');
  return new DOMParser().parseFromString(sanitized.markup, 'image/svg+xml').documentElement;
};

describe('sanitizeSvg', () => {
  it('strips scripts, embedded documents, animations and event handlers', () => {
    const root = parse(
      sanitizeSvg(
        svg(
          '<script>alert(1)</script><foreignObject><div>x</div></foreignObject>' +
            '<rect onclick="alert(2)" onmouseover="x()" width="1"><set attributeName="href" to="javascript:x"/></rect>',
        ),
      ),
    );
    expect(root.querySelector('script, foreignObject, set')).toBeNull();
    const rect = root.querySelector('rect');
    expect(rect?.getAttribute('onclick')).toBeNull();
    expect(rect?.getAttribute('onmouseover')).toBeNull();
    expect(rect?.getAttribute('width')).toBe('1');
  });

  it('drops external links and resources, keeps references inside the document', () => {
    const root = parse(
      sanitizeSvg(
        svg(
          '<a href="https://evil.example"><text>a</text></a><use xlink:href="#shape"/><image href="http://x/y.png"/>' +
            '<rect style="fill: url(http://x/p.svg#p); stroke: url(#grad)"/><a href="javascript:alert(1)"/>' +
            '<style>@import url(http://x/a.css); .a { fill: url(https://x/f) }</style>',
        ),
      ),
    );
    expect(root.querySelector('a')?.getAttribute('href')).toBeNull();
    expect(root.querySelector('use')?.getAttribute('xlink:href')).toBe('#shape');
    expect(root.querySelector('image')?.getAttribute('href')).toBeNull();
    expect(root.querySelector('rect')?.getAttribute('style')).toBe('fill: none; stroke: url(#grad)');
    expect(root.querySelectorAll('a')[1].getAttribute('href')).toBeNull();
    expect(root.querySelector('style')?.textContent).not.toMatch(/http|@import/);
  });

  it('keeps the drawing at a fixed pixel size, taken from its viewBox when it has none', () => {
    const sanitized = sanitizeSvg(svg(''));
    expect(sanitized).toMatchObject({ width: 200, height: 100 });
    const root = parse(sanitized);
    expect(root.getAttribute('viewBox')).toBe('0 0 200 100');
    expect(root.getAttribute('width')).toBe('200');
    const boxed = sanitizeSvg(svg('', 'viewBox="5 5 10 20" width="300"'));
    expect(boxed).toMatchObject({ width: 300, height: 20 });
    expect(parse(boxed).getAttribute('viewBox')).toBe('5 5 10 20');
    expect(sanitizeSvg(svg('', ''))).toMatchObject({ width: 0, height: 0 });
  });

  it('overlays the hotspots as transparent rectangles and makes every entity focusable', () => {
    const root = parse(
      sanitizeSvg(svg('<g data-fluid-ref="c1" data-fluid-type="Class"><text>Collection</text></g>'), [
        { ref: { id: 'c2' }, x: 10, y: 20, width: 30, height: 40 },
      ]),
    );
    const spot = root.querySelector('[data-fluid-hotspot]');
    expect(spot?.getAttribute('fill')).toBe('transparent');
    expect(['x', 'y', 'width', 'height'].map((a) => spot?.getAttribute(a))).toEqual(['10', '20', '30', '40']);
    expect(spot?.getAttribute('aria-label')).toBe('Entity c2');
    const group = root.querySelector('g');
    expect(group?.getAttribute('tabindex')).toBe('0');
    expect(group?.getAttribute('role')).toBe('link');
    expect(group?.getAttribute('aria-label')).toBe('Collection');
  });

  it('refuses what is not an SVG document', () => {
    expect(sanitizeSvg('<html><body/></html>')).toBeUndefined();
    expect(sanitizeSvg('<svg><unclosed></svg>')).toBeUndefined();
  });
});

describe('frameHeight', () => {
  it('fits the drawing as it first appears: full width, at most 1:1, within bounds', () => {
    expect(frameHeight({ width: 400, height: 300 }, 800, 0.4)).toBe(300);
    expect(frameHeight({ width: 1600, height: 600 }, 800, 0.4)).toBe(300);
    expect(frameHeight({ width: 400, height: 3000 }, 800, 0.4)).toBe(600);
    expect(frameHeight({ width: 400, height: 20 }, 800, 0.4)).toBe(120);
    expect(frameHeight({ width: 0, height: 0 }, 800, 0.4)).toBe(320);
  });
});

describe('readRef', () => {
  it('reads the entity of an element or of its closest ancestor naming one', () => {
    const root = parse(sanitizeSvg(svg('<g data-fluid-ref="c1" data-fluid-type="Class"><text>C</text></g><g data-fluid-ref="u"/>')));
    expect(readRef(root.querySelector('text'))).toEqual({ id: 'c1', type: 'Class' });
    expect(readRef(root.querySelector('[data-fluid-ref="u"]'))).toEqual({ id: 'u' });
    expect(readRef(root)).toBeUndefined();
    expect(readRef(null)).toBeUndefined();
  });
});
