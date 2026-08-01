"""API-Blueprints registrieren."""


def register_blueprints(app):
    from api.routes_health import bp as health_bp
    from api.routes_sensors import bp as sensors_bp
    from api.routes_motor import bp as motor_bp
    from api.routes_plans import bp as plans_bp
    from api.routes_consumption import bp as consumption_bp
    from api.routes_system import bp as system_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(sensors_bp)
    app.register_blueprint(motor_bp)
    app.register_blueprint(plans_bp)
    app.register_blueprint(consumption_bp)
    app.register_blueprint(system_bp)
