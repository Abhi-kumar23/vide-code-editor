import React from "react";
import Image from "next/image";
import SignInFormClient from "@/modules/auth/components/sign-in-form-client";

const Page = () => {
    return(
       <>
       <Image src={"/login.svg"} alt='login-image' height={400} width={400} className="m-6 object-cover"/>
       <SignInFormClient/>
       </>
    )
}

export default Page