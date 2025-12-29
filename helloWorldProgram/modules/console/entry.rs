#[cfg(not(target_arch = "wasm32"))]
env_logger::init();
#[cfg(target_arch = "wasm32")]
console_log::init_with_level(log::Level::Info).unwrap();