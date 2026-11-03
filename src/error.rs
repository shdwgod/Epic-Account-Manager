use std::fmt;

/// Errors surfaced to the UI. `App` messages are shown verbatim; everything
/// else is wrapped as "Unexpected error: ..." exactly like the old Electron app.
#[derive(Debug)]
pub enum Error {
    App(String),
    Unexpected(String),
}

pub type Result<T> = std::result::Result<T, Error>;

impl Error {
    pub fn app(msg: impl Into<String>) -> Self {
        Error::App(msg.into())
    }

    pub fn wrong_password() -> Self {
        Error::App("Wrong password.".into())
    }

    /// Text shown in the toast.
    pub fn message(&self) -> String {
        match self {
            Error::App(m) => m.clone(),
            Error::Unexpected(m) => format!("Unexpected error: {m}"),
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message())
    }
}

impl std::error::Error for Error {}

macro_rules! unexpected_from {
    ($($t:ty),* $(,)?) => {$(
        impl From<$t> for Error {
            fn from(e: $t) -> Self { Error::Unexpected(e.to_string()) }
        }
    )*};
}

unexpected_from!(std::io::Error, serde_json::Error, base64::DecodeError, std::string::FromUtf8Error);
