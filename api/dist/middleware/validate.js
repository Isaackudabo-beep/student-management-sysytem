export function validate(schema, target = "body") {
    return (req, _res, next) => {
        const parsed = schema.parse(req[target]);
        req[target] = parsed;
        next();
    };
}
