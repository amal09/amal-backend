import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})

// You’re creating a Multer middleware instance using the configured storage engine.
export const upload = multer({ 
    storage,
 })