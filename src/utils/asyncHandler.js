const asyncHandler = (fn) =>  (req, res, next) => {
    Promise.resolve(fn(req, res, next))
    .catch(error => next(error))
}

export {asyncHandler}

/*
const asyncHandler = (fn) => async (req, res, next) => {
    try{
        await fn(req, res, next)
    }catch(error){
        res.status(err.code || 500).json({
            success: true,
            message: err.message
        })    
    }
}
*/