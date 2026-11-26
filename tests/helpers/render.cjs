globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;

const TestRenderer = require('react-test-renderer');

const {act} = TestRenderer;

function hostNodes(root, predicate) {
    return root.findAll((node) => typeof node.type === 'string' && predicate(node.props));
}

function render(element) {
    let renderer;
    act(() => {
        renderer = TestRenderer.create(element);
    });
    const root = renderer.root;
    return {
        root,
        update(next) {
            act(() => renderer.update(next));
        },
        unmount() {
            act(() => renderer.unmount());
        },
        byRole: (role) => hostNodes(root, (props) => props.role === role || props.accessibilityRole === role),
        byLabel: (label) => hostNodes(root, (props) => props['aria-label'] === label || props.accessibilityLabel === label),
    };
}

module.exports = {act, render};
